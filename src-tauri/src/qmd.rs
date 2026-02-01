use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tokio::time::{sleep, Duration};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QmdSearchResult {
    pub docid: String,
    pub score: f64,
    pub file: String,
    pub title: String,
    pub context: Option<String>,
    pub snippet: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QmdStatus {
    pub available: bool,
    pub version: Option<String>,
    pub collection_exists: bool,
    pub collection_name: Option<String>,
}

/// Get the path to the bundled QMD script
fn get_qmd_script_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    // In production: resources are bundled at Contents/Resources/_up_/qmd/
    if let Ok(resource_path) = app.path().resource_dir() {
        let bundled_path = resource_path
            .join("_up_")
            .join("qmd")
            .join("src")
            .join("qmd.ts");

        if bundled_path.exists() {
            return Ok(bundled_path);
        }
    }

    // In development: use the source qmd directory relative to the project root
    // The Tauri app runs from src-tauri/, so ../qmd/ is the qmd directory
    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("qmd").join("src").join("qmd.ts"))
        .unwrap_or_default();

    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!(
        "QMD script not found. Checked bundled and dev paths."
    ))
}

/// Run a QMD command using the bundled Bun sidecar (or system bun in dev mode)
async fn run_qmd_command(
    app: &AppHandle,
    args: Vec<&str>,
) -> Result<(String, String, bool), String> {
    let qmd_script = get_qmd_script_path(app)?;
    let qmd_script_str = qmd_script.to_string_lossy().to_string();

    // Build args: [qmd.ts, ...args]
    let mut full_args: Vec<String> = vec![qmd_script_str];
    full_args.extend(args.iter().map(|s| s.to_string()));

    let is_sqlite_busy = |stdout: &str, stderr: &str| -> bool {
        let has_busy = |text: &str| text.contains("SQLITE_BUSY") || text.contains("database is locked");
        has_busy(stdout) || has_busy(stderr)
    };

    // Try sidecar first (production), fall back to system bun (development)
    let shell = app.shell();
    let mut attempt = 0u8;
    let mut delay_ms = 150u64;

    loop {
        let (stdout, stderr, success) = if let Ok(sidecar) = shell.sidecar("bun") {
            let output = sidecar
                .args(&full_args)
                .output()
                .await
                .map_err(|e| format!("Failed to execute bun sidecar: {}", e))?;

            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let success = output.status.success();
            (stdout, stderr, success)
        } else {
            // Fall back to system bun for development
            use std::process::Command;
            let result = Command::new("bun")
                .args(&full_args)
                .output()
                .map_err(|e| format!("Failed to execute system bun: {}", e))?;

            let stdout = String::from_utf8_lossy(&result.stdout).to_string();
            let stderr = String::from_utf8_lossy(&result.stderr).to_string();
            let success = result.status.success();
            (stdout, stderr, success)
        };

        if success || !is_sqlite_busy(&stdout, &stderr) || attempt >= 4 {
            return Ok((stdout, stderr, success));
        }

        attempt += 1;
        sleep(Duration::from_millis(delay_ms)).await;
        delay_ms = std::cmp::min(delay_ms * 2, 1200);
    }
}

async fn qmd_available(app: &AppHandle) -> Result<bool, String> {
    // QMD doesn't implement --version; use --help as a lightweight availability check.
    let (_stdout, _stderr, success) = run_qmd_command(app, vec!["--help"]).await?;
    Ok(success)
}

/// Search using bundled QMD
/// mode: "search" (BM25), "vsearch" (semantic), "query" (hybrid with LLM)
#[tauri::command]
pub async fn qmd_search(
    app: AppHandle,
    query: String,
    mode: String,
    limit: Option<u32>,
    collection: Option<String>,
) -> Result<Vec<QmdSearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let mut args = vec![mode.as_str(), "--json", query.as_str()];

    let limit_str = limit.map(|l| l.to_string());
    if let Some(ref l) = limit_str {
        args.push("--limit");
        args.push(l);
    }

    let collection_str = collection.clone();
    if let Some(ref c) = collection_str {
        args.push("--collection");
        args.push(c);
    }

    let (stdout, stderr, success) = run_qmd_command(&app, args).await?;

    if !success {
        return Err(format!("qmd search failed: {}", stderr));
    }

    // Handle "No results found." output from QMD
    let trimmed = stdout.trim();
    if trimmed.is_empty() || trimmed == "No results found." {
        return Ok(vec![]);
    }

    // Parse JSON output - QMD outputs a JSON array
    let results: Vec<QmdSearchResult> = serde_json::from_str(trimmed)
        .map_err(|e| format!("Failed to parse qmd output: {} (output: {})", e, stdout))?;

    Ok(results)
}

/// Check QMD availability and collection status
#[tauri::command]
pub async fn qmd_status(app: AppHandle, vault_path: String) -> Result<QmdStatus, String> {
    // Check if bundled QMD is available by running --help
    let available = match qmd_available(&app).await {
        Ok(true) => true,
        _ => false,
    };
    let version = None;

    if !available {
        return Ok(QmdStatus {
            available: false,
            version: None,
            collection_exists: false,
            collection_name: None,
        });
    }

    // Check if vault is already a collection
    let list_result = run_qmd_command(&app, vec!["collection", "list"]).await;

    let mut collection_exists = false;
    let mut collection_name = None;

    if let Ok((stdout, _, true)) = list_result {
        let normalized_vault = vault_path.trim_end_matches('/');

        // Parse text output - format is like "name (qmd://name/)\n  Pattern: ...\n  Path: /actual/path"
        for line in stdout.lines() {
            if line.contains(normalized_vault) {
                collection_exists = true;
                break;
            }
        }

        // Alternative: check if any collection name matches the folder name
        let folder_name = std::path::Path::new(&vault_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        if !collection_exists && !folder_name.is_empty() {
            if stdout.contains(&format!("{} (qmd://", folder_name)) {
                collection_exists = true;
                collection_name = Some(folder_name.to_string());
            }
        }
    }

    Ok(QmdStatus {
        available,
        version,
        collection_exists,
        collection_name,
    })
}

/// Ensure a QMD collection exists for the vault
#[tauri::command]
pub async fn qmd_ensure_collection(
    app: AppHandle,
    vault_path: String,
    collection_name: Option<String>,
) -> Result<QmdStatus, String> {
    // Check if bundled QMD is available
    let available = match qmd_available(&app).await {
        Ok(true) => true,
        _ => false,
    };

    if !available {
        return Err("Bundled QMD is not available".to_string());
    }

    // Derive collection name from folder
    let name = collection_name.unwrap_or_else(|| {
        std::path::Path::new(&vault_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("vault")
            .to_string()
    });

    // Try to create collection
    let (stdout, stderr, success) = run_qmd_command(
        &app,
        vec!["collection", "add", &vault_path, "--name", &name],
    )
    .await?;

    // Check if collection already exists (not an error)
    if !success && !stderr.contains("already exists") && !stdout.contains("already exists") {
        return Err(format!("Failed to create collection: {}", stderr));
    }

    // Return status
    Ok(QmdStatus {
        available: true,
        version: None,
        collection_exists: true,
        collection_name: Some(name),
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub name: String,
    pub filename: String,
    pub exists: bool,
    pub size_bytes: u64,
    pub required_for: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelsStatus {
    pub embedding: ModelInfo,
    pub generation: ModelInfo,
    pub reranking: ModelInfo,
    pub all_ready: bool,
    pub semantic_ready: bool, // embedding model exists
}

/// Get the QMD model cache directory
fn get_model_cache_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".cache").join("qmd").join("models")
}

/// Check if QMD models are downloaded
#[tauri::command]
pub async fn qmd_model_status() -> Result<ModelsStatus, String> {
    let cache_dir = get_model_cache_dir();

    // Model filenames (must match what node-llama-cpp downloads)
    let embed_file = "hf_ggml-org_embeddinggemma-300M-Q8_0.gguf";
    let gen_file = "hf_tobil_qmd-query-expansion-1.7B-q4_k_m.gguf";
    let rerank_file = "hf_ggml-org_qwen3-reranker-0.6b-q8_0.gguf";

    let check_model = |filename: &str, name: &str, required_for: &str| -> ModelInfo {
        let path = cache_dir.join(filename);
        let exists = path.exists() && !path.with_extension("gguf.ipull").exists();
        let size_bytes = if exists {
            std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };
        ModelInfo {
            name: name.to_string(),
            filename: filename.to_string(),
            exists,
            size_bytes,
            required_for: required_for.to_string(),
        }
    };

    let embedding = check_model(embed_file, "Embedding (embeddinggemma-300M)", "Semantic search");
    let generation = check_model(gen_file, "Query Expansion (qmd-query-expansion-1.7B)", "Semantic & Hybrid search");
    let reranking = check_model(rerank_file, "Reranking (qwen3-reranker-0.6b)", "Hybrid search");

    let semantic_ready = embedding.exists && generation.exists;
    let all_ready = semantic_ready && reranking.exists;

    Ok(ModelsStatus {
        embedding,
        generation,
        reranking,
        all_ready,
        semantic_ready,
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub model: String,
    pub progress: f64,
    pub downloaded_mb: f64,
    pub total_mb: f64,
    pub speed: String,
    pub eta: String,
    pub done: bool,
    pub error: Option<String>,
}

/// Download QMD models with progress events
#[tauri::command]
pub async fn qmd_download_models(app: AppHandle) -> Result<(), String> {
    let qmd_script = get_qmd_script_path(&app)?;
    let qmd_script_str = qmd_script.to_string_lossy().to_string();

    // Run qmd pull command
    let shell = app.shell();

    let args = vec![qmd_script_str.as_str(), "pull"];

    let (mut rx, _child) = if let Ok(sidecar) = shell.sidecar("bun") {
        sidecar
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to spawn bun sidecar: {}", e))?
    } else {
        // Fall back to system bun
        shell
            .command("bun")
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to spawn system bun: {}", e))?
    };

    use tauri_plugin_shell::process::CommandEvent;

    // Process output and emit progress events
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                let text = String::from_utf8_lossy(&line);
                // Parse progress from output like: "⏵ model.gguf  25.34% (325.07MB/1.28GB)  1.64kB/s | 5m left"
                if let Some(progress) = parse_download_progress(&text) {
                    let _ = app.emit("qmd-download-progress", progress);
                }
            }
            CommandEvent::Terminated(status) => {
                let success = status.code.map(|c| c == 0).unwrap_or(false);
                let done_event = DownloadProgress {
                    model: "all".to_string(),
                    progress: 100.0,
                    downloaded_mb: 0.0,
                    total_mb: 0.0,
                    speed: "".to_string(),
                    eta: "".to_string(),
                    done: true,
                    error: if success {
                        None
                    } else {
                        Some("Download failed".to_string())
                    },
                };
                let _ = app.emit("qmd-download-progress", done_event);
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

fn parse_download_progress(line: &str) -> Option<DownloadProgress> {
    // Parse lines like: "⏵ hf_tobil_...k_m.gguf  25.34% (325.07MB/1.28GB)  1.64kB/s | 5m left"
    if !line.contains('%') || !line.contains("gguf") {
        return None;
    }

    // Extract model name (simplified)
    let model = if line.contains("embeddinggemma") {
        "embedding"
    } else if line.contains("query-expansion") || line.contains("tobil") {
        "generation"
    } else if line.contains("reranker") {
        "reranking"
    } else {
        "unknown"
    };

    // Extract percentage
    let progress = line
        .split_whitespace()
        .find(|s| s.ends_with('%'))
        .and_then(|s| s.trim_end_matches('%').parse::<f64>().ok())
        .unwrap_or(0.0);

    // Extract size info (MB/GB)
    let (downloaded_mb, total_mb) = if let Some(start) = line.find('(') {
        if let Some(end) = line.find(')') {
            let size_str = &line[start + 1..end];
            let parts: Vec<&str> = size_str.split('/').collect();
            if parts.len() == 2 {
                let downloaded = parse_size_mb(parts[0]);
                let total = parse_size_mb(parts[1]);
                (downloaded, total)
            } else {
                (0.0, 0.0)
            }
        } else {
            (0.0, 0.0)
        }
    } else {
        (0.0, 0.0)
    };

    // Extract speed
    let speed = line
        .split_whitespace()
        .find(|s| s.contains("/s"))
        .unwrap_or("")
        .to_string();

    // Extract ETA
    let eta = if let Some(idx) = line.find("left") {
        let before = &line[..idx];
        before
            .rsplit_once('|')
            .map(|(_, s)| s.trim())
            .unwrap_or("")
            .to_string()
    } else {
        "".to_string()
    };

    Some(DownloadProgress {
        model: model.to_string(),
        progress,
        downloaded_mb,
        total_mb,
        speed,
        eta,
        done: false,
        error: None,
    })
}

fn parse_size_mb(s: &str) -> f64 {
    let s = s.trim();
    if s.ends_with("GB") {
        s.trim_end_matches("GB").parse::<f64>().unwrap_or(0.0) * 1024.0
    } else if s.ends_with("MB") {
        s.trim_end_matches("MB").parse::<f64>().unwrap_or(0.0)
    } else if s.ends_with("KB") || s.ends_with("kB") {
        s.trim_end_matches("KB")
            .trim_end_matches("kB")
            .parse::<f64>()
            .unwrap_or(0.0)
            / 1024.0
    } else {
        0.0
    }
}
