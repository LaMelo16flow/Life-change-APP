/*
  # Add Remaining Countries and Remove Region Column

  1. Schema Changes
    - Drop the region column from countries table

  2. Data Updates
    - Add remaining countries not yet in the database
    - Complete list of all UN member states and territories

  3. Notes
    - All new countries are set as active by default
    - Currency codes and symbols included for each country
*/

ALTER TABLE countries DROP COLUMN IF EXISTS region;

INSERT INTO countries (code, name, currency_code, currency_symbol, tax_rate, is_active) VALUES
('AD', 'Andorra', 'EUR', '€', 4.5, true),
('AI', 'Anguilla', 'XCD', '$', 0, true),
('AQ', 'Antarctica', 'USD', '$', 0, true),
('AS', 'American Samoa', 'USD', '$', 0, true),
('AX', 'Aland Islands', 'EUR', '€', 24, true),
('BL', 'Saint Barthelemy', 'EUR', '€', 0, true),
('BM', 'Bermuda', 'BMD', '$', 0, true),
('BQ', 'Bonaire, Sint Eustatius and Saba', 'USD', '$', 8, true),
('BV', 'Bouvet Island', 'NOK', 'kr', 0, true),
('CC', 'Cocos (Keeling) Islands', 'AUD', '$', 0, true),
('CK', 'Cook Islands', 'NZD', '$', 15, true),
('CX', 'Christmas Island', 'AUD', '$', 0, true),
('EH', 'Western Sahara', 'MAD', 'د.م.', 20, true),
('FK', 'Falkland Islands', 'FKP', '£', 0, true),
('FO', 'Faroe Islands', 'DKK', 'kr', 25, true),
('GF', 'French Guiana', 'EUR', '€', 0, true),
('GG', 'Guernsey', 'GBP', '£', 0, true),
('GI', 'Gibraltar', 'GIP', '£', 0, true),
('GL', 'Greenland', 'DKK', 'kr', 0, true),
('GP', 'Guadeloupe', 'EUR', '€', 8.5, true),
('GS', 'South Georgia and the South Sandwich Islands', 'GBP', '£', 0, true),
('GU', 'Guam', 'USD', '$', 4, true),
('HM', 'Heard Island and McDonald Islands', 'AUD', '$', 0, true),
('IM', 'Isle of Man', 'GBP', '£', 20, true),
('IO', 'British Indian Ocean Territory', 'USD', '$', 0, true),
('JE', 'Jersey', 'GBP', '£', 5, true),
('KY', 'Cayman Islands', 'KYD', '$', 0, true),
('LI', 'Liechtenstein', 'CHF', 'CHF', 8, true),
('MC', 'Monaco', 'EUR', '€', 20, true),
('MF', 'Saint Martin', 'EUR', '€', 0, true),
('MO', 'Macao', 'MOP', 'MOP$', 0, true),
('MP', 'Northern Mariana Islands', 'USD', '$', 0, true),
('MQ', 'Martinique', 'EUR', '€', 8.5, true),
('MS', 'Montserrat', 'XCD', '$', 0, true),
('NC', 'New Caledonia', 'XPF', '₣', 11, true),
('NF', 'Norfolk Island', 'AUD', '$', 0, true),
('NU', 'Niue', 'NZD', '$', 5, true),
('PF', 'French Polynesia', 'XPF', '₣', 16, true),
('PM', 'Saint Pierre and Miquelon', 'EUR', '€', 0, true),
('PN', 'Pitcairn', 'NZD', '$', 0, true),
('PS', 'Palestine', 'ILS', '₪', 16, true),
('RE', 'Reunion', 'EUR', '€', 8.5, true),
('SH', 'Saint Helena', 'SHP', '£', 0, true),
('SJ', 'Svalbard and Jan Mayen', 'NOK', 'kr', 25, true),
('SM', 'San Marino', 'EUR', '€', 17, true),
('SX', 'Sint Maarten', 'ANG', 'ƒ', 5, true),
('TC', 'Turks and Caicos Islands', 'USD', '$', 0, true),
('TF', 'French Southern Territories', 'EUR', '€', 0, true),
('TK', 'Tokelau', 'NZD', '$', 0, true),
('TL', 'Timor-Leste', 'USD', '$', 2.5, true),
('UM', 'United States Minor Outlying Islands', 'USD', '$', 0, true),
('VA', 'Vatican City', 'EUR', '€', 0, true),
('VG', 'British Virgin Islands', 'USD', '$', 0, true),
('VI', 'U.S. Virgin Islands', 'USD', '$', 0, true),
('WF', 'Wallis and Futuna', 'XPF', '₣', 0, true),
('XK', 'Kosovo', 'EUR', '€', 18, true),
('YT', 'Mayotte', 'EUR', '€', 0, true)
ON CONFLICT (code) DO NOTHING;
