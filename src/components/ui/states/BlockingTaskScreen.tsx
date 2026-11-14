'use client';

import { Modal, Paper, Stack, Text, Title } from '@mantine/core';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import classes from './BlockingTaskScreen.module.css';

type BlockingTaskScreenProps = {
  opened: boolean;
  title: string;
  description: string;
  /**
   * Must describe the real task in progress (see components/brand/SPIDER.md):
   * `working` for saving/preparing, `scanning` for reading account data.
   */
  mascotState?: SpiderMascotState;
};

export default function BlockingTaskScreen({
  opened,
  title,
  description,
  mascotState = 'working',
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
        <Paper p="xl" radius="md" className={classes.overlayCard} aria-busy="true">
          <Stack gap="lg" align="center" ta="center" className={classes.content}>
            <SpiderMascot state={mascotState} size={96} tone="dark" paused={!opened} />
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
