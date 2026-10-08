CREATE TABLE `post_opportunities` (
  `post_id` BIGINT UNSIGNED NOT NULL,
  `category` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `deadline` DATETIME(3) NOT NULL,
  `apply_url` VARCHAR(500) NOT NULL,
  PRIMARY KEY (`post_id`),
  KEY `idx_opportunity_category_deadline` (`category`, `deadline`, `post_id`),
  CONSTRAINT `fk_opportunity_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_opportunity_category` CHECK (
    `category` IN ('frontend', 'backend', 'mobile', 'data-ai',
      'devops-cloud', 'design', 'security', 'other')
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
