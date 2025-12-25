import { useQuery } from "@tanstack/react-query";

interface DiagnosticsData {
  timestamp: string;
  environment: string;
  health: {
    status: string;
    database: string;
    dbLatencyMs?: number;
    styleCount?: number;
    error?: string;
  };
  cvExtraction: {
    enabled: boolean;
  };
  jobs: {
    queued: number;
    running: number;
    failed: number;
    succeeded: number;
    canceled: number;
    queueDepth: number;
    totalRecent: number;
    jobs: Array<{
      id: string;
      type: string;
      status: string;
      progress: number;
      progressMessage?: string;
      error?: string;
      retryCount: number;
      maxRetries: number;
      createdAt: string;
      completedAt?: string;
      styleId?: string;
    }>;
  };
}

export default function Diagnostics() {
  const { data, isLoading, error, refetch } = useQuery<DiagnosticsData>({
    queryKey: ["diagnostics"],
    queryFn: async () => {
      const res = await fetch("/api/diagnostics");
      if (!res.ok) throw new Error("Failed to fetch diagnostics");
      return res.json();
    },
    refetchInterval: 5000,
  });

  return (
    <div style={{ padding: "20px", fontFamily: "monospace", fontSize: "14px" }}>
      <h1 style={{ marginBottom: "20px" }}>System Diagnostics</h1>
      
      <button 
        onClick={() => refetch()} 
        style={{ marginBottom: "20px", padding: "8px 16px", cursor: "pointer" }}
        data-testid="button-refresh"
      >
        Refresh
      </button>

      {isLoading && <p>Loading...</p>}
      
      {error && (
        <div style={{ color: "red", marginBottom: "20px" }}>
          Error: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {data && (
        <div>
          <section style={{ marginBottom: "30px" }}>
            <h2>Health</h2>
            <pre style={{ background: "#f5f5f5", padding: "10px", overflow: "auto" }}>
              {JSON.stringify(data.health, null, 2)}
            </pre>
            <p>
              <strong>Status:</strong>{" "}
              <span style={{ color: data.health.status === "healthy" ? "green" : "red" }}>
                {data.health.status}
              </span>
            </p>
            <p><strong>Database:</strong> {data.health.database}</p>
            {data.health.dbLatencyMs !== undefined && (
              <p><strong>DB Latency:</strong> {data.health.dbLatencyMs}ms</p>
            )}
            {data.health.styleCount !== undefined && (
              <p><strong>Style Count:</strong> {data.health.styleCount}</p>
            )}
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2>CV Extraction</h2>
            <p>
              <strong>Enabled:</strong>{" "}
              <span style={{ color: data.cvExtraction.enabled ? "green" : "orange" }}>
                {data.cvExtraction.enabled ? "Yes" : "No"}
              </span>
            </p>
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2>Job Queue</h2>
            <table style={{ borderCollapse: "collapse", marginBottom: "15px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 12px 4px 0" }}>Queue Depth (active):</td>
                  <td style={{ fontWeight: "bold" }}>{data.jobs.queueDepth}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 12px 4px 0" }}>Queued:</td>
                  <td style={{ fontWeight: "bold" }}>{data.jobs.queued}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 12px 4px 0" }}>Running:</td>
                  <td style={{ fontWeight: "bold" }}>{data.jobs.running}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 12px 4px 0" }}>Failed:</td>
                  <td style={{ fontWeight: "bold", color: data.jobs.failed > 0 ? "red" : "inherit" }}>
                    {data.jobs.failed}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 12px 4px 0" }}>Succeeded:</td>
                  <td style={{ fontWeight: "bold" }}>{data.jobs.succeeded}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 12px 4px 0" }}>Canceled:</td>
                  <td style={{ fontWeight: "bold" }}>{data.jobs.canceled}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 12px 4px 0" }}>Total Recent (last 100):</td>
                  <td style={{ fontWeight: "bold" }}>{data.jobs.totalRecent}</td>
                </tr>
              </tbody>
            </table>

            {data.jobs.jobs.length > 0 && (
              <>
                <h3>Recent Jobs</h3>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #ccc" }}>
                      <th style={{ textAlign: "left", padding: "8px" }}>ID</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Type</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Progress</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Retries</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Error</th>
                      <th style={{ textAlign: "left", padding: "8px" }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.jobs.map((job) => (
                      <tr key={job.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "8px" }}>{job.id.slice(0, 8)}...</td>
                        <td style={{ padding: "8px" }}>{job.type}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ 
                            color: job.status === "failed" ? "red" : 
                                   job.status === "running" ? "blue" : 
                                   job.status === "succeeded" ? "green" :
                                   job.status === "canceled" ? "orange" : "inherit"
                          }}>
                            {job.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px" }}>
                          {job.progress ?? 0}%
                          {job.progressMessage && <span> - {job.progressMessage}</span>}
                        </td>
                        <td style={{ padding: "8px" }}>{job.retryCount}/{job.maxRetries}</td>
                        <td style={{ padding: "8px", color: "red", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {job.error ? job.error.slice(0, 50) + (job.error.length > 50 ? "..." : "") : "-"}
                        </td>
                        <td style={{ padding: "8px" }}>{new Date(job.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <section style={{ marginBottom: "30px" }}>
            <h2>Raw Response</h2>
            <pre style={{ background: "#f5f5f5", padding: "10px", overflow: "auto", maxHeight: "400px" }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </section>

          <p style={{ color: "#666", fontSize: "12px" }}>
            Last updated: {data.timestamp} | Environment: {data.environment}
          </p>
        </div>
      )}
    </div>
  );
}
