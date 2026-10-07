CREATE TABLE `member_reputation_days` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `day_utc` DATE NOT NULL,
  `points` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`member_id`, `day_utc`),
  CONSTRAINT `fk_reputation_day_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_reputation_day_limit` CHECK (`points` <= 50)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
