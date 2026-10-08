CREATE TABLE `project_notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `project_id` BIGINT UNSIGNED NOT NULL,
  `recipient_id` BIGINT UNSIGNED NOT NULL,
  `actor_id` BIGINT UNSIGNED NOT NULL,
  `kind` VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `read_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_page` (`recipient_id`, `id`),
  KEY `idx_notifications_unread` (`recipient_id`, `read_at`),
  KEY `idx_notifications_project` (`project_id`),
  KEY `idx_notifications_actor` (`actor_id`),
  CONSTRAINT `fk_notifications_project` FOREIGN KEY (`project_id`)
    REFERENCES `member_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_notifications_actor` FOREIGN KEY (`actor_id`)
    REFERENCES `members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_notifications_kind` CHECK (
    `kind` IN ('request', 'accepted', 'rejected', 'discussion')
  )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;
