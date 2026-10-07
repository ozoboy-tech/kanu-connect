CREATE TABLE `member_streaks` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `current_days` INT UNSIGNED NOT NULL DEFAULT 0,
  `best_days` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_active_day` DATE NULL,
  PRIMARY KEY (`member_id`),
  CONSTRAINT `fk_streak_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_streak_best` CHECK (`best_days` >= `current_days`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
