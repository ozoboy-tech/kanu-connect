CREATE TABLE IF NOT EXISTS `member_discovery_preferences` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `welcome_completed` BOOLEAN NOT NULL DEFAULT FALSE,
  `tour_completed` BOOLEAN NOT NULL DEFAULT FALSE,
  `reminders_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`member_id`),
  CONSTRAINT `fk_discovery_preferences_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;