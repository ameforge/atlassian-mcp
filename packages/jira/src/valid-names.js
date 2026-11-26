// Jira rejects an unknown issue type without naming the valid ones, so the caller would keep guessing.
const withValidNames = async (call, pattern, label, names) => {
  try {
    return await call();
  } catch (err) {
    if (!pattern.test(err.message)) throw err;
    const list = await names(err).catch(() => null);
    if (!list?.length) throw err;
    throw new Error(
      `${err.message}\nValid ${label}: ${[...new Set(list)].join(", ")}`,
    );
  }
};

export const withIssueTypes = (call, jira, project) =>
  // JQL: "... for the field 'issuetype'" (or 'type'); create/update: {"issuetype":"..."}.
  withValidNames(
    call,
    /field '(issuetype|type)'|"issuetype"/,
    "issue types",
    async () =>
      project
        ? (await jira("GET", `/project/${project}`)).issueTypes.map(
            (t) => t.name,
          )
        : (await jira("GET", "/issuetype")).map((t) => t.name),
  );

const UNKNOWN_USER =
  /The value '([^']+)' does not exist for the field 'assignee'/;

export const withJqlNames = (call, jira) =>
  withValidNames(
    () =>
      withValidNames(
        () => withIssueTypes(call, jira),
        /field 'priority'/,
        "priorities",
        async () => (await jira("GET", "/priority")).map((p) => p.name),
      ),
    UNKNOWN_USER,
    "users (JQL takes the username)",
    async (err) => {
      const params = new URLSearchParams({
        maxResults: "10",
        username: err.message.match(UNKNOWN_USER)[1],
      });
      return (await jira("GET", `/user/search?${params}`)).map(
        (u) => `${u.name} (${u.displayName})`,
      );
    },
  );

// Jira names the screen, not the fix, so callers kept retrying the same estimate.
export const estimateHint = (message) =>
  /"timetracking":"Field 'timetracking' cannot be set/.test(message)
    ? "This project's edit screen has no Time Tracking field, so original_estimate cannot be set on its tickets; leave it out."
    : null;
