/**
 * Slack Skill — Permission enforcement tests
 *
 * Tests that slack-permissions.yaml restrictions are enforced before API calls.
 * Uses a fake SLACK_BOT_TOKEN — permission checks happen before any network call,
 * so the fake token triggers a Slack API error only if permissions pass (which means
 * the permission check itself didn't block it).
 */

import { describe, expect, test } from "bun:test";
import { slackWithPerms, SKILL_ROOT, TIMEOUT } from "./slack-helpers";

const FAKE_TOKEN = "xoxb-fake-token-for-permission-tests";

describe("slack skill: channel deny list", () => {
  const permsWithDeny = `channels:
  allow: []
  deny: [executive, confidential]
dm: false
threads: true
reactions: true
files: false
search: true
`;

  test(
    "blocks message to denied channel",
    async () => {
      const result = await slackWithPerms(
        "message-send",
        { channel: "#executive", text: "test" },
        permsWithDeny,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("deny list");
    },
    TIMEOUT,
  );

  test(
    "blocks message to denied channel without # prefix",
    async () => {
      const result = await slackWithPerms(
        "message-send",
        { channel: "confidential", text: "test" },
        permsWithDeny,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("deny list");
    },
    TIMEOUT,
  );

  test(
    "blocks channel-info for denied channel",
    async () => {
      const result = await slackWithPerms(
        "channel-info",
        { channel: "#executive" },
        permsWithDeny,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    },
    TIMEOUT,
  );

  test(
    "blocks message-list for denied channel",
    async () => {
      const result = await slackWithPerms(
        "message-list",
        { channel: "#confidential" },
        permsWithDeny,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    },
    TIMEOUT,
  );
});

describe("slack skill: channel allow list", () => {
  const permsWithAllow = `channels:
  allow: [engineering, general]
  deny: []
dm: false
threads: true
reactions: true
files: false
search: true
`;

  test(
    "blocks message to channel not in allow list",
    async () => {
      const result = await slackWithPerms(
        "message-send",
        { channel: "#random", text: "test" },
        permsWithAllow,
        FAKE_TOKEN,
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
      const result = await slackWithPerms(
        "channel-info",
        { channel: "#secret" },
        permsWithAllow,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
    },
    TIMEOUT,
  );
});

describe("slack skill: deny takes precedence over allow", () => {
  const permsWithBoth = `channels:
  allow: [engineering, executive]
  deny: [executive]
dm: false
threads: true
reactions: true
files: false
search: true
`;

  test(
    "deny overrides allow for same channel",
    async () => {
      const result = await slackWithPerms(
        "message-send",
        { channel: "#executive", text: "test" },
        permsWithBoth,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("deny list");
    },
    TIMEOUT,
  );
});

describe("slack skill: DM permission", () => {
  const permsNoDm = `channels:
  allow: []
  deny: []
dm: false
threads: true
reactions: true
files: false
search: true
`;

  test(
    "blocks DM channel IDs when dm is disabled",
    async () => {
      const result = await slackWithPerms(
        "message-send",
        { channel: "D0123456789", text: "test" },
        permsNoDm,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("direct messages");
    },
    TIMEOUT,
  );
});

describe("slack skill: feature toggles", () => {
  test(
    "blocks thread-reply when threads disabled",
    async () => {
      const perms = `channels:
  allow: []
  deny: []
dm: false
threads: false
reactions: true
files: false
search: true
`;
      const result = await slackWithPerms(
        "thread-reply",
        { channel: "#general", thread_ts: "1234567890.123456", text: "test" },
        perms,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("threads");
    },
    TIMEOUT,
  );

  test(
    "blocks reaction-add when reactions disabled",
    async () => {
      const perms = `channels:
  allow: []
  deny: []
dm: false
threads: true
reactions: false
files: false
search: true
`;
      const result = await slackWithPerms(
        "reaction-add",
        { channel: "#general", timestamp: "1234567890.123456", emoji: "thumbsup" },
        perms,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("reactions");
    },
    TIMEOUT,
  );

  test(
    "blocks reaction-remove when reactions disabled",
    async () => {
      const perms = `channels:
  allow: []
  deny: []
dm: false
threads: true
reactions: false
files: false
search: true
`;
      const result = await slackWithPerms(
        "reaction-remove",
        { channel: "#general", timestamp: "1234567890.123456", emoji: "thumbsup" },
        perms,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("reactions");
    },
    TIMEOUT,
  );

  test(
    "blocks file-upload when files disabled",
    async () => {
      const perms = `channels:
  allow: []
  deny: []
dm: false
threads: true
reactions: true
files: false
search: true
`;
      const result = await slackWithPerms(
        "file-upload",
        { channel: "#general", filename: "test.txt", content: "hello" },
        perms,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("files");
    },
    TIMEOUT,
  );

  test(
    "blocks message-search when search disabled",
    async () => {
      const perms = `channels:
  allow: []
  deny: []
dm: false
threads: true
reactions: true
files: false
search: false
`;
      const result = await slackWithPerms(
        "message-search",
        { query: "test" },
        perms,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Permission denied");
      expect(result.error).toContain("search");
    },
    TIMEOUT,
  );
});

describe("slack skill: channel-list has no permission check", () => {
  test(
    "channel-list runs without channel permission checks (fails on API, not permissions)",
    async () => {
      const perms = `channels:
  allow: [only-this]
  deny: [everything-else]
dm: false
threads: false
reactions: false
files: false
search: false
`;
      // channel-list doesn't check_channel, so it should get past permissions
      // and fail on the API call with the fake token
      const result = await slackWithPerms(
        "channel-list",
        { limit: 5 },
        perms,
        FAKE_TOKEN,
      );
      expect(result.success).toBe(false);
      // Should fail with API error (invalid_auth), NOT permission denied
      expect(result.error).toContain("Slack API error");
      expect(result.error).not.toContain("Permission denied");
    },
    TIMEOUT,
  );
});
