-- Safe contract violation diagnostics for async generation batches.
-- Stores controlled metadata only; never stores raw prompt, raw output, item text, headers, tokens, or stack traces.

ALTER TABLE generation_job_batches
  ADD COLUMN contract_violation_type TEXT CHECK (
    contract_violation_type IS NULL
    OR contract_violation_type IN (
      'OPTIONS_COUNT_INVALID',
      'OPTIONS_TEXT_INVALID',
      'ANSWER_CODE_INVALID',
      'DISTRACTOR_KEY_INVALID',
      'DISTRACTOR_CORRECT_ANSWER_INCLUDED',
      'DISTRACTOR_MISSING_WRONG_OPTION',
      'DISTRACTOR_REQUIRED_FIELD_MISSING'
    )
  );

ALTER TABLE generation_job_batches
  ADD COLUMN contract_violation_types TEXT;

ALTER TABLE generation_job_batches
  ADD COLUMN contract_violation_item_index INTEGER CHECK (
    contract_violation_item_index IS NULL
    OR contract_violation_item_index > 0
  );

ALTER TABLE generation_job_batches
  ADD COLUMN contract_violation_field TEXT CHECK (
    contract_violation_field IS NULL
    OR contract_violation_field IN (
      'options',
      'answer',
      'qualityMeta.distractorDesign',
      'misconceptionTag',
      'misconceptionDescription',
      'whyStudentsMayChooseIt',
      'whyItIsWrong',
      'revisionNote'
    )
  );

ALTER TABLE generation_job_batches
  ADD COLUMN contract_violation_option_code TEXT CHECK (
    contract_violation_option_code IS NULL
    OR contract_violation_option_code IN (
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
      'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
      'U', 'V', 'W', 'X', 'Y', 'Z', 'OTHER'
    )
  );
