/**
 * Slack Skill — Message integration tests
 *
 * Requires TEST_SLACK_BOT_TOKEN and TEST_SLACK_CHANNEL to be set.
 * These tests make real API calls to Slack.
 *
 * Happy-path tests use slackWithPerms() to allow the test channel.
 * BAND.md has a restrictive default (allow: [only-this]) so tests
 * must explicitly permit the test channel.
 * Allow-list enforcement tests also use slackWithPerms() with a different config.
 */

import { describe, expect, test } from "bun:test";
import { slack, slackWithPerms, requireSlackEnv, TIMEOUT } from "./slack-helpers";

/** Build a perms YAML that allows the test channel with all features enabled. */
function testPerms(channelName: string): string {
  return `channels:
  allow: [${channelName}]
  deny: []
dm: false
threads: true
reactions: true
files: false
search: true
`;
}

describe("slack skill: messages", () => {
  test(
    "sends a message to a channel",
    async () => {
      const { channel } = requireSlackEnv();
      const channelName = channel.replace(/^#/, "");
      const result = await slackWithPerms("message-send", {
        channel,
        text: `bands test message ${Date.now()}`,
      }, testPerms(channelName));
      if (!result.success) throw new Error(`message-send failed: ${result.error}`);
      const data = result.data as any;
      expect(data.ok).toBe(true);
      expect(data.channel).toBeDefined();
      expect(data.ts).toBeDefined();
      expect(data.message.text).toContain("bands test message");
    },
    TIMEOUT,
  );

  test(
    "lists messages in a channel",
    async () => {
      const { channel } = requireSlackEnv();
      const channelName = channel.replace(/^#/, "");
      const result = await slackWithPerms("message-list", {
        channel,
        limit: 5,
      }, testPerms(channelName));
      if (!result.success) throw new Error(`message-list failed: ${result.error}`);
      const data = result.data as any[];
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].text).toBeDefined();
      expect(data[0].ts).toBeDefined();
    },
    TIMEOUT,
  );

  test(
    "lists channels",
    async () => {
      requireSlackEnv();
      const result = await slack("channel-list", { limit: 5 });
      if (!result.success) throw new Error(`channel-list failed: ${result.error}`);
      const data = result.data as any[];
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].id).toBeDefined();
      expect(data[0].name).toBeDefined();
    },
    TIMEOUT,
  );

  test(
    "gets channel info",
    async () => {
      const { channel } = requireSlackEnv();
      const channelName = channel.replace(/^#/, "");
      const result = await slackWithPerms("channel-info", { channel }, testPerms(channelName));
      if (!result.success) throw new Error(`channel-info failed: ${result.error}`);
      const data = result.data as any;
      expect(data.id).toBeDefined();
      expect(data.name).toBeDefined();
    },
    TIMEOUT,
  );
});

describe("slack skill: allow list enforcement (live)", () => {
  test(
    "blocks message-send to channel not in allow list",
    async () => {
      const { channel } = requireSlackEnv();
      const channelName = channel.replace(/^#/, "");
      const perms = `channels:
  allow: [${channelName}]
  deny: []
dm: false
threads: true
reactions: true
files: false
search: true
`;
      const result = await slackWithPerms(
        "message-send",
        { channel: "#not-allowed-channel", text: "should fail" },
        perms,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("allow list");
    },
    TIMEOUT,
  );

  test(
    "blocks message-list for channel not in allow list",
    async () => {
      const { channel } = requireSlackEnv();
      const channelName = channel.replace(/^#/, "");
      const perms = `channels:
  allow: [${channelName}]
  deny: []
dm: false
threads: true
reactions: true
files: false
search: true
`;
      const result = await slackWithPerms(
        "message-list",
        { channel: "#not-allowed-channel", limit: 5 },
        perms,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("allow list");
    },
    TIMEOUT,
  );

  test(
    "blocks channel-info for channel not in allow list",
    async () => {
      const { channel } = requireSlackEnv();
      const channelName = channel.replace(/^#/, "");
      const perms = `channels:
  allow: [${channelName}]
  deny: []
dm: false
threads: true
reactions: true
files: false
search: true
`;
      const result = await slackWithPerms(
        "channel-info",
        { channel: "#not-allowed-channel" },
        perms,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("allow list");
    },
    TIMEOUT,
  );
});
