CREATE TABLE IF NOT EXISTS `member_followed_topics` (
  `member_id` BIGINT UNSIGNED NOT NULL,
  `keyword` VARCHAR(32) NOT NULL,
  PRIMARY KEY (`member_id`, `keyword`),
  KEY `idx_followed_topic_members` (`keyword`, `member_id`),
  CONSTRAINT `fk_followed_topic_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;