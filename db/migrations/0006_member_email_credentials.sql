CREATE TABLE `member_email_credentials` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `password_hash` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `verified_at` DATETIME(3) NULL,

  PRIMARY KEY (`member_id`),
  UNIQUE KEY `uq_member_email` (`email`),
  CONSTRAINT `fk_member_email_member`
    FOREIGN KEY (`member_id`) REFERENCES `members` (`id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
