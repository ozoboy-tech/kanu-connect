CREATE TABLE `comment_votes` (
  `comment_id` BIGINT UNSIGNED NOT NULL,
  `voter_id` BIGINT UNSIGNED NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`comment_id`, `voter_id`),
  KEY `idx_comment_votes_voter` (`voter_id`),
  CONSTRAINT `fk_comment_vote_comment` FOREIGN KEY (`comment_id`)
    REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comment_vote_voter` FOREIGN KEY (`voter_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
