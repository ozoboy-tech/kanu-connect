ALTER TABLE `member_notifications`
  DROP CHECK `chk_notification_target`,
  ADD UNIQUE KEY `uq_notification_solution` (`recipient_id`, `kind`, `comment_id`),
  ADD CONSTRAINT `chk_notification_target_v2` CHECK (
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
    ) OR (
      `project_id` IS NULL AND `post_id` IS NOT NULL
      AND `comment_id` IS NOT NULL AND `source_id` IS NULL
      AND `kind` = 'solution'
    )
  );
