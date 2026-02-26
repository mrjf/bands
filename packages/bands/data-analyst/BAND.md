---
band: data-analyst
icon: 📊
description: Data analysis with Python, pandas, and read-only database access

allow:
  read:
    - "/tmp/**"
    - "./data/**"
    - "./*.csv"
    - "./*.json"
    - "./*.parquet"
  write:
    - "/tmp/**"
    - "./output/**"
  net:
    - "*.amazonaws.com"
    - "storage.googleapis.com"
    - "*.blob.core.windows.net"
  cli:
    - "python *"
    - "python3 *"
    - "pip install *"
    - "cat *"
    - "head *"
    - "tail *"
    - "wc *"
    - "jq *"
    - "curl -s *"
    - "psql -c *"

deny:
  read:
    - "**/.env*"
    - "**/secrets/**"
    - "**/.git/**"
  cli:
    - "curl -X POST *"
    - "curl -X PUT *"
    - "curl -X DELETE *"
    - "rm *"
    - "sudo *"

limit:
  maxRuntimeMs: 30m
  maxOutputBytes: 100m
---

# Data Analyst Band

For data analysis tasks with Python. Includes:
- Read access to data files (CSV, JSON, Parquet)
- Network access to cloud storage (S3, GCS, Azure)
- Read-only database queries
- Python with pip for installing packages

Blocks:
- Mutating HTTP requests (POST, PUT, DELETE)
- Access to secrets and .env files
- Destructive file operations
