CREATE TABLE `member_blocks` (
  `blocker_id` BIGINT UNSIGNED NOT NULL,
  `blocked_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`blocker_id`, `blocked_id`),
  KEY `idx_member_blocks_blocked` (`blocked_id`, `blocker_id`),
  CONSTRAINT `fk_member_blocks_blocker` FOREIGN KEY (`blocker_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_member_blocks_blocked` FOREIGN KEY (`blocked_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_member_blocks_self` CHECK (`blocker_id` <> `blocked_id`)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
