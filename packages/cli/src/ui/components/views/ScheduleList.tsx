/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import type { ScheduledJob } from '@papert-code/papert-code-core';
import { formatDurationMs } from '../../../utils/duration.js';

interface ScheduleListProps {
  cwd: string;
  jobs: ScheduledJob<unknown>[];
}

function formatSchedule(job: ScheduledJob<unknown>): string {
  if (job.schedule.kind === 'every') {
    return `every ${formatDurationMs(job.schedule.everyMs)}`;
  }
  if (job.schedule.kind === 'cron') {
    return `cron ${job.schedule.expr}${job.schedule.tz ? ` (${job.schedule.tz})` : ''}`;
  }
  return `at ${new Date(job.schedule.atMs).toISOString()}`;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({ cwd, jobs }) => (
  <Box flexDirection="column" marginTop={1} marginBottom={1}>
    <Text>Scheduler store: {cwd}</Text>
    <Box marginTop={1} flexDirection="column">
      {jobs.length === 0 ? (
        <Text>No scheduled jobs configured.</Text>
      ) : (
        <>
          <Text bold underline>
            Scheduled Jobs:
          </Text>
          <Box flexDirection="column" paddingLeft={2} marginTop={1}>
            {jobs.map((job) => {
              const nextRun =
                typeof job.state.nextRunAtMs === 'number'
                  ? new Date(job.state.nextRunAtMs).toISOString()
                  : 'n/a';
              const lastRun =
                typeof job.state.lastRunAtMs === 'number'
                  ? new Date(job.state.lastRunAtMs).toISOString()
                  : 'n/a';
              const status = job.state.lastStatus ?? 'never';
              const delivery = job.delivery?.kind ?? 'none';
              const sessionTarget = job.sessionTarget ?? 'main';

              return (
                <Box key={job.id} flexDirection="column" marginBottom={1}>
                  <Text>
                    <Text color="cyan">{job.name}</Text>
                    <Text dimColor>{` (${job.id})`}</Text>
                  </Text>
                  <Box paddingLeft={2} flexDirection="column">
                    <Text dimColor>
                      {job.enabled ? 'enabled' : 'disabled'} | {formatSchedule(job)}
                    </Text>
                    <Text dimColor>
                      target {sessionTarget} | delivery {delivery} | status {status}
                    </Text>
                    <Text dimColor>
                      next {nextRun} | last {lastRun}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Box>
    <Box marginTop={1}>
      <Text dimColor>
        Tip: use /schedule add, /schedule update, or /schedule remove to manage jobs
      </Text>
    </Box>
  </Box>
);
