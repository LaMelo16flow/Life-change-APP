/*
  # Add Foreign Key Relationship Between Profiles and Countries

  1. Changes
    - Add foreign key constraint linking profiles.country_code to countries.code
    - This enables joining profiles with countries table to retrieve currency information
    
  2. Security
    - No changes to RLS policies
    - Foreign key ensures data integrity
*/

ALTER TABLE profiles
ADD CONSTRAINT profiles_country_code_fkey
FOREIGN KEY (country_code)
REFERENCES countries(code)
ON UPDATE CASCADE
ON DELETE RESTRICT;
