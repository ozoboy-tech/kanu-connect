CREATE TABLE `member_reputation_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `action` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source_id` BIGINT UNSIGNED NOT NULL,
  `points` TINYINT UNSIGNED NOT NULL,
  `awarded_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reputation_source` (`member_id`, `action`, `source_id`),
  KEY `idx_reputation_member_time` (`member_id`, `awarded_at`),
  CONSTRAINT `fk_reputation_event_member` FOREIGN KEY (`member_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_reputation_points` CHECK (`points` <= 50)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
