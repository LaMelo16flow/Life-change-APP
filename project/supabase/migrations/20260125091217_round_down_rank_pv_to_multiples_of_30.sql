/*
  # Round Down Rank PV Requirements to Multiples of 30

  This migration adjusts all rank PV requirements to be exact multiples of 30 by rounding down.
  
  ## Changes Made
  
  1. **Updated Rank PV Requirements:**
     - **Prospect**: 0 → 0 (unchanged, already valid)
     - **Silver**: 300 → 300 (unchanged, already valid)
     - **Gold**: 500 → 480 (rounded down by 20)
     - **D1**: 1,000 → 990 (rounded down by 10)
     - **D2**: 2,000 → 1,980 (rounded down by 20)
     - **D3**: 4,000 → 3,990 (rounded down by 10)
     - **D4**: 8,000 → 7,980 (rounded down by 20)
     - **D5**: 16,000 → 15,990 (rounded down by 10)
     - **D6**: 32,000 → 31,980 (rounded down by 20)
     - **D7**: 64,000 → 63,990 (rounded down by 10)
  
  ## Purpose
  
  Ensures all rank requirements align with the PV counting system where each 
  multiple of 30 PV equals one whole unit for rank progression tracking.
*/

-- Update Gold rank: 500 → 480
UPDATE ranks 
SET required_pv = '480'
WHERE name = 'Gold';

-- Update D1 rank: 1000 → 990
UPDATE ranks 
SET required_pv = '990'
WHERE name = 'D1';

-- Update D2 rank: 2000 → 1980
UPDATE ranks 
SET required_pv = '1980'
WHERE name = 'D2';

-- Update D3 rank: 4000 → 3990
UPDATE ranks 
SET required_pv = '3990'
WHERE name = 'D3';

-- Update D4 rank: 8000 → 7980
UPDATE ranks 
SET required_pv = '7980'
WHERE name = 'D4';

-- Update D5 rank: 16000 → 15990
UPDATE ranks 
SET required_pv = '15990'
WHERE name = 'D5';

-- Update D6 rank: 32000 → 31980
UPDATE ranks 
SET required_pv = '31980'
WHERE name = 'D6';

-- Update D7 rank: 64000 → 63990
UPDATE ranks 
SET required_pv = '63990'
WHERE name = 'D7';