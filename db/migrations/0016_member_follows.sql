CREATE TABLE `member_follows` (
  `follower_id` BIGINT UNSIGNED NOT NULL,
  `followed_id` BIGINT UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`follower_id`, `followed_id`),
  KEY `idx_member_follows_follower_recent` (`follower_id`, `created_at`, `followed_id`),
  KEY `idx_member_follows_followed` (`followed_id`, `created_at`, `follower_id`),
  CONSTRAINT `fk_member_follow_follower` FOREIGN KEY (`follower_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_member_follow_followed` FOREIGN KEY (`followed_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_member_follow_self` CHECK (`follower_id` <> `followed_id`)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
