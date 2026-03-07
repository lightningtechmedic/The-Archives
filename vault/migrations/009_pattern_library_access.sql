-- Add pattern_library_access column to enclave_members
ALTER TABLE enclave_members
  ADD COLUMN IF NOT EXISTS pattern_library_access BOOLEAN NOT NULL DEFAULT false;

-- Owner always has access — auto-set for existing owners
UPDATE enclave_members
  SET pattern_library_access = true
  WHERE role = 'owner';

-- RLS: owners can update pattern_library_access for members in their enclave
DROP POLICY IF EXISTS "enclave_members_owner_update" ON enclave_members;
CREATE POLICY "enclave_members_owner_update"
  ON enclave_members FOR UPDATE
  USING (
    enclave_id IN (
      SELECT enclave_id FROM enclave_members em2
      WHERE em2.user_id = auth.uid() AND em2.role = 'owner'
    )
  );
