'use client';

import { Modal, Paper, Stack, Text, Title } from '@mantine/core';
import classes from './BlockingTaskScreen.module.css';

type BlockingTaskScreenProps = {
  opened: boolean;
  title: string;
  description: string;
};

export default function BlockingTaskScreen({
  opened,
  title,
  description,
}: BlockingTaskScreenProps) {
  return (
    <Modal
      opened={opened}
      onClose={() => {}}
      fullScreen
      centered
      withCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      padding={0}
      overlayProps={{ opacity: 0.18, blur: 2 }}
    >
      <div className={classes.viewport}>
        <Paper p="xl" radius="xl" className={classes.overlayCard}>
          <Stack gap="lg" align="center" ta="center" className={classes.content}>
            <div className={classes.ballStage} aria-hidden="true">
              <div className={classes.ball} />
              <div className={classes.ballShadow} />
              <div className={`${classes.ripple} ${classes.ripplePrimary}`} />
              <div className={`${classes.ripple} ${classes.rippleSecondary}`} />
            </div>
            <Stack gap={6} maw={320}>
              <Title order={3}>{title}</Title>
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            </Stack>
          </Stack>
        </Paper>
      </div>
    </Modal>
  );
}
