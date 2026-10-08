ALTER TABLE `project_notifications`
  MODIFY COLUMN `project_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `post_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `comment_id` BIGINT UNSIGNED NULL,
  ADD COLUMN `source_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD UNIQUE KEY `uq_notification_source` (`recipient_id`, `source_id`),
  ADD KEY `idx_notification_post` (`post_id`),
  ADD KEY `idx_notification_comment` (`comment_id`),
  ADD CONSTRAINT `fk_notification_post` FOREIGN KEY (`post_id`)
    REFERENCES `posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_notification_comment` FOREIGN KEY (`comment_id`)
    REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  DROP CHECK `chk_notifications_kind`,
  ADD CONSTRAINT `chk_notification_target` CHECK (
    (
      `project_id` IS NOT NULL AND `post_id` IS NULL
      AND `comment_id` IS NULL AND `source_id` IS NULL
      AND `kind` IN ('request', 'accepted', 'rejected', 'discussion')
    ) OR (
      `project_id` IS NULL AND `post_id` IS NOT NULL AND `source_id` IS NOT NULL
      AND (
        (`kind` = 'publication' AND `comment_id` IS NULL)
        OR `kind` = 'mention'
        OR (`kind` = 'reply' AND `comment_id` IS NOT NULL)
      )
    )
  ),
  RENAME TO `member_notifications`;
