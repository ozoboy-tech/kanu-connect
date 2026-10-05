CREATE TABLE `post_comments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `post_id` BIGINT UNSIGNED NOT NULL,
  `member_id` BIGINT UNSIGNED NOT NULL,
  `parent_id` BIGINT UNSIGNED NULL,
  `depth` TINYINT UNSIGNED NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_post_comments_public_id` (`public_id`),
  KEY `idx_post_comments_post` (`post_id`, `created_at`, `id`),
  KEY `idx_post_comments_parent` (`parent_id`),
  KEY `idx_post_comments_member` (`member_id`),
  CONSTRAINT `fk_post_comment_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`),
  CONSTRAINT `fk_post_comment_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`),
  CONSTRAINT `fk_post_comment_parent` FOREIGN KEY (`parent_id`) REFERENCES `post_comments` (`id`),
  CONSTRAINT `chk_post_comment_body` CHECK (CHAR_LENGTH(TRIM(`body`)) > 0),
  CONSTRAINT `chk_post_comment_depth` CHECK (`depth` <= 4)
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
