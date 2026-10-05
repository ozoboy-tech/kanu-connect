CREATE TABLE `member_private_identities` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `legal_name` VARCHAR(160) NOT NULL,

  PRIMARY KEY (`member_id`),
  CONSTRAINT `chk_private_legal_name`
    CHECK (CHAR_LENGTH(TRIM(`legal_name`)) > 0),
  CONSTRAINT `fk_private_identity_member`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;