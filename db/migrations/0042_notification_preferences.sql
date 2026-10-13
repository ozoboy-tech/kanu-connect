CREATE TABLE `member_notification_preferences` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `projects_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `community_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `opportunities_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `solutions_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`member_id`),
  CONSTRAINT `fk_notification_preferences_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
