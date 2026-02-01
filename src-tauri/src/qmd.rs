use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

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
    let resource_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    // Tauri preserves relative paths: ../qmd/ becomes _up_/qmd/
    let qmd_path = resource_path
        .join("_up_")
        .join("qmd")
        .join("src")
        .join("qmd.ts");

    if qmd_path.exists() {
        Ok(qmd_path)
    } else {
        Err(format!("QMD script not found at {:?}", qmd_path))
    }
}

/// Run a QMD command using the bundled Bun sidecar
async fn run_qmd_command(
    app: &AppHandle,
    args: Vec<&str>,
) -> Result<(String, String, bool), String> {
    let qmd_script = get_qmd_script_path(app)?;
    let qmd_script_str = qmd_script.to_string_lossy().to_string();

    // Build args: [qmd.ts, ...args]
    let mut full_args: Vec<String> = vec![qmd_script_str];
    full_args.extend(args.iter().map(|s| s.to_string()));

    let shell = app.shell();
    let sidecar = shell
        .sidecar("bun")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?;

    let output = sidecar
        .args(&full_args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute bun sidecar: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let success = output.status.success();

    Ok((stdout, stderr, success))
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

    // Parse JSON output - QMD outputs a JSON array
    let results: Vec<QmdSearchResult> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse qmd output: {} (output: {})", e, stdout))?;

    Ok(results)
}

/// Check QMD availability and collection status
#[tauri::command]
pub async fn qmd_status(app: AppHandle, vault_path: String) -> Result<QmdStatus, String> {
    // Check if bundled QMD is available by running --version
    let version_result = run_qmd_command(&app, vec!["--version"]).await;

    let (available, version) = match version_result {
        Ok((stdout, _, true)) => {
            let v = stdout.trim().to_string();
            (true, Some(v))
        }
        _ => (false, None),
    };

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
    let version_result = run_qmd_command(&app, vec!["--version"]).await;

    if version_result.is_err() || !version_result.as_ref().unwrap().2 {
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
