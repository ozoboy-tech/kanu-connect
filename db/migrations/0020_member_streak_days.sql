CREATE TABLE `member_streak_days` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `day_utc` DATE NOT NULL,
  PRIMARY KEY (`member_id`, `day_utc`),
  CONSTRAINT `fk_streak_day_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
