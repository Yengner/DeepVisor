"use client";
import { useJobProgress } from "@/app/hooks/useJobProgress";
import { Modal, Progress, Text, Timeline, Group, Button } from "@mantine/core";
import { IconCheck, IconAlertTriangle, IconLoader } from "@tabler/icons-react";

export default function JobLoadingModal({
    jobId, opened, onClose, onDone
}: { jobId: string; opened: boolean; onClose: () => void; onDone?: () => void }) {

    const { job, events, loading } = useJobProgress(jobId);
    const pct = job?.percent ?? 0;
    const done = job?.status === "done";
    const error = job?.status === "error";

    return (
        <Modal opened={opened} onClose={onClose} centered size="lg" withCloseButton={!done}>
            <Group justify="space-between" mb="sm">
                <Text fw={600}>Working on your request…</Text>
                <Text size="sm" c="dimmed">{job?.step ?? "…"}</Text>
            </Group>

            <Progress value={pct} striped animated color={error ? "red" : done ? "green" : "blue"} mb="md" />
            <Text size="sm" c="dimmed" mb="md">{pct}% complete</Text>

            <Timeline bulletSize={20} lineWidth={2}>
                {(events || []).map((e) => {
                    const icon =
                        e.status === "success" ? <IconCheck size={12} /> :
                            e.status === "error" ? <IconAlertTriangle size={12} /> :
                                <IconLoader size={12} />;
                    const color =
                        e.status === "success" ? "green" :
                            e.status === "error" ? "red" : "blue";

                    return (
                        <Timeline.Item key={e.id} bullet={icon} color={color} title={e.step}>
                            <Text size="xs" c="dimmed">{e.message || e.status}</Text>
                        </Timeline.Item>
                    );
                })}
            </Timeline>

            {done && (
                <Group justify="right" mt="lg">
                    <Button onClick={onDone} color="green">Continue</Button>
                </Group>
            )}
            {error && (
                <Group justify="right" mt="lg">
                    <Button onClick={onClose} color="red" variant="light">Close</Button>
                </Group>
            )}
        </Modal>
    );
}
