CREATE TABLE `member_profile_skills` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `label` VARCHAR(64) NOT NULL,

  PRIMARY KEY (`member_id`, `label`),
  CONSTRAINT `chk_member_skill_label`
    CHECK (CHAR_LENGTH(TRIM(`label`)) > 0),
  CONSTRAINT `fk_member_skill_profile`
    FOREIGN KEY (`member_id`)
    REFERENCES `member_profiles` (`member_id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;