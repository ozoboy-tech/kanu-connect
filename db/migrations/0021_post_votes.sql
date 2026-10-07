CREATE TABLE `post_votes` (
  `post_id` BIGINT UNSIGNED NOT NULL,
  `voter_id` BIGINT UNSIGNED NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`post_id`, `voter_id`),
  KEY `idx_post_votes_voter` (`voter_id`),
  CONSTRAINT `fk_post_vote_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_post_vote_voter` FOREIGN KEY (`voter_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
