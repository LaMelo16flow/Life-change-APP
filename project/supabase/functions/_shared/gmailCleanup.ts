// Frees space in the LC Shop Gmail account (lcshop.app@gmail.com) from the app
// itself, over IMAP with the same GMAIL_USER / GMAIL_APP_PASSWORD secrets used
// for sending.
//
// When the account (15 GB shared by Gmail/Drive/Photos) reaches CLEAN_AT_PERCENT
// it permanently deletes the OLDEST app emails - copies in "Sent" and bounce
// notices from mailer-daemon - never anything newer than KEEP_DAYS, until usage
// is back under STOP_AT_PERCENT. Nothing else in the mailbox is touched.

export const CLEAN_AT_PERCENT = 45; // "close to 50%"
export const STOP_AT_PERCENT = 35;
export const KEEP_DAYS = 30;
const BATCH = 500;
const MAX_BATCHES = 10;

export interface CleanupResult {
  usedPercent: number;
  deleted: number;
  cleaned: boolean;
}

interface ImapOptions {
  hostname?: string;
  port?: number;
  caCerts?: string[];
  now?: Date;
}

class Imap {
  private conn!: Deno.TlsConn;
  private buf = "";
  private tagN = 0;
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  async connect(o: ImapOptions) {
    this.conn = await Deno.connectTls({
      hostname: o.hostname ?? "imap.gmail.com",
      port: o.port ?? 993,
      ...(o.caCerts ? { caCerts: o.caCerts } : {}),
    });
    await this.readUntil((l) => l.startsWith("* OK") || l.startsWith("* PREAUTH"), "greeting");
  }

  private async readLine(): Promise<string> {
    while (!this.buf.includes("\r\n")) {
      const chunk = new Uint8Array(16384);
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error("IMAP connection closed");
      this.buf += this.dec.decode(chunk.subarray(0, n));
    }
    const i = this.buf.indexOf("\r\n");
    const line = this.buf.slice(0, i);
    this.buf = this.buf.slice(i + 2);
    return line;
  }

  private async readUntil(done: (line: string) => boolean, what: string): Promise<string[]> {
    const lines: string[] = [];
    for (let k = 0; k < 100000; k++) {
      const line = await this.readLine();
      lines.push(line);
      if (done(line)) return lines;
    }
    throw new Error(`IMAP: no end of ${what}`);
  }

  /** Sends a command; returns the untagged lines. Throws on NO/BAD. */
  async cmd(command: string, label = command.split(" ")[0]): Promise<string[]> {
    const tag = `a${++this.tagN}`;
    await this.conn.write(this.enc.encode(`${tag} ${command}\r\n`));
    const lines = await this.readUntil((l) => l.startsWith(`${tag} `), label);
    const last = lines[lines.length - 1];
    if (!last.startsWith(`${tag} OK`)) throw new Error(`IMAP ${label} failed: ${last.slice(tag.length + 1)}`);
    return lines.slice(0, -1);
  }

  close() {
    try { this.conn.close(); } catch { /* already closed */ }
  }
}

const quote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function imapDate(d: Date): string {
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()}-${m[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

async function usedPercent(imap: Imap): Promise<number> {
  const lines = await imap.cmd("GETQUOTAROOT INBOX");
  for (const l of lines) {
    const m = l.match(/\(STORAGE (\d+) (\d+)\)/i);
    if (m) return (Number(m[1]) / Number(m[2])) * 100;
  }
  throw new Error("IMAP: storage quota not reported");
}

/** Finds a mailbox by its special-use flag (\Sent, \Trash): names differ by language. */
async function specialMailbox(imap: Imap, flag: string): Promise<string | null> {
  const lines = await imap.cmd('LIST "" "*"');
  for (const l of lines) {
    const m = l.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/i);
    if (m && m[1].split(" ").some((f) => f.toLowerCase() === flag.toLowerCase())) return m[2].trim();
  }
  return null;
}

async function uidSearch(imap: Imap, criteria: string): Promise<number[]> {
  const lines = await imap.cmd(`UID SEARCH ${criteria}`, "SEARCH");
  const uids: number[] = [];
  for (const l of lines) {
    if (/^\* SEARCH\b/i.test(l)) {
      for (const t of l.slice(8).trim().split(/\s+/)) if (/^\d+$/.test(t)) uids.push(Number(t));
    }
  }
  return uids.sort((a, b) => a - b); // lowest UID = oldest
}

/** Moves messages to Trash, then expunges them there: Gmail frees the space only then. */
async function deleteForever(imap: Imap, mailbox: string, trash: string, uids: number[]): Promise<number> {
  await imap.cmd(`SELECT ${mailbox}`, "SELECT");
  const moved = await imap.cmd(`UID MOVE ${uids.join(",")} ${trash}`, "MOVE");
  let trashUids: string | null = null;
  for (const l of moved) {
    const m = l.match(/\[COPYUID \d+ \S+ (\S+)\]/i);
    if (m) trashUids = trashUids ? `${trashUids},${m[1]}` : m[1];
  }
  await imap.cmd(`SELECT ${trash}`, "SELECT");
  if (trashUids) {
    await imap.cmd(`UID STORE ${trashUids} +FLAGS.SILENT (\\Deleted)`, "STORE");
    await imap.cmd("EXPUNGE");
  }
  return uids.length;
}

export async function cleanupGmailIfNeeded(opts: ImapOptions = {}): Promise<CleanupResult> {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) throw new Error("Gmail secrets missing");

  const imap = new Imap();
  await imap.connect(opts);
  try {
    await imap.cmd(`LOGIN ${quote(user)} ${quote(pass.replace(/\s+/g, ""))}`, "LOGIN");
    let pct = await usedPercent(imap);
    if (pct < CLEAN_AT_PERCENT) {
      await imap.cmd("LOGOUT").catch(() => undefined);
      return { usedPercent: pct, deleted: 0, cleaned: false };
    }

    const sent = await specialMailbox(imap, "\\Sent");
    const trash = await specialMailbox(imap, "\\Trash");
    if (!trash) throw new Error("IMAP: Trash folder not found");
    const before = imapDate(new Date((opts.now ?? new Date()).getTime() - KEEP_DAYS * 864e5));
    const sources: Array<[string, string]> = [];
    if (sent) sources.push([sent, `BEFORE ${before}`]);
    sources.push(['"INBOX"', `BEFORE ${before} FROM "mailer-daemon"`]);

    let deleted = 0;
    let batches = 0;
    for (const [box, criteria] of sources) {
      while (batches < MAX_BATCHES && pct >= STOP_AT_PERCENT) {
        await imap.cmd(`SELECT ${box}`, "SELECT");
        const uids = (await uidSearch(imap, criteria)).slice(0, BATCH);
        if (uids.length === 0) break;
        deleted += await deleteForever(imap, box, trash, uids);
        batches++;
        pct = await usedPercent(imap);
      }
    }
    await imap.cmd("LOGOUT").catch(() => undefined);
    return { usedPercent: pct, deleted, cleaned: true };
  } finally {
    imap.close();
  }
}
