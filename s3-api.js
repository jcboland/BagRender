/**
 * S3 API Utility Module
 * Handles uploads via presigned URLs from backend API with automatic retries.
 */

class S3API {
  constructor(apiUrl, options = {}) {
    this.apiUrl = apiUrl;
    this.maxRetries = options.maxRetries ?? 3;          // total retry attempts
    this.retryBaseDelay = options.retryBaseDelay ?? 500; // ms
  }

  /**
   * Exponential backoff with jitter
   */
  async _delay(attempt) {
    const base = this.retryBaseDelay * 2 ** attempt;
    const jitter = Math.random() * this.retryBaseDelay;
    return new Promise(res => setTimeout(res, base + jitter));
  }

  /**
   * Upload a file to S3 using presigned URL (internal async method)
   */
  async _uploadFile(key, blob, contentType, progressCallback = null) {
    console.log(`Called _uploadFile with key: ${key}`);

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Step 1: Request presigned PUT URL from API
        const uploadUrlResp = await fetch(`${this.apiUrl}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key })
        });

        if (!uploadUrlResp.ok) {
          const text = await uploadUrlResp.text();
          throw new Error(`Failed to get upload URL: ${uploadUrlResp.status} - ${text}`);
        }

        const uploadData = await uploadUrlResp.json();
        const uploadUrl = uploadData.upload_url;
        if (!uploadUrl) throw new Error("Upload URL missing in response");

        // Step 2: Upload the file to S3 using presigned URL
        return await this._uploadToPresignedUrl(uploadUrl, blob, contentType, progressCallback, key);

      } catch (error) {
        console.warn(`Attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          await this._delay(attempt);
          continue;
        }

        console.error("All retries failed for _uploadFile");
        return { success: false, key, error: error.message };
      }
    }
  }

  /**
   * Upload blob to presigned URL with progress tracking and retry logic.
   */
  async _uploadToPresignedUrl(uploadUrl, blob, contentType, progressCallback, key) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          if (progressCallback) {
            xhr.upload.addEventListener("progress", (e) => {
              if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressCallback(percent);
              }
            });
          }

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ success: true, key });
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", contentType);
          xhr.send(blob);
        });

      } catch (err) {
        console.warn(`Upload attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt < this.maxRetries) {
          await this._delay(attempt);
          continue;
        }
        throw err;
      }
    }
  }


  /**
   * AWS SDK-compatible wrappers
   */
  putObject(params, callback) {
    this._uploadFile(params.Key, params.Body, params.ContentType)
      .then(result => {
        if (result.success) callback(null, { key: result.key });
        else callback(new Error(result.error), null);
      })
      .catch(err => callback(err, null));
  }

  upload(params) {
    const self = this;
    let progressCallback = null;

    const uploadObj = {
      on(event, callback) {
        if (event === "httpUploadProgress") {
          progressCallback = (percent) => {
            callback({ loaded: percent, total: 100 });
          };
        }
        return uploadObj;
      },
      send(callback) {
        self._uploadFile(params.Key, params.Body, params.ContentType, progressCallback)
          .then(result => {
            if (result.success) callback(null, { key: result.key });
            else callback(new Error(result.error), null);
          })
          .catch(err => callback(err, null));
      }
    };

    return uploadObj;
  }

  getObject(params, callback) {
    const self = this;
    let progressCallback = null;

    const getObj = {
      on(event, callback) {
        if (event === "httpDownloadProgress") {
          progressCallback = callback;
        }
        return getObj;
      },
      send(callback) {
        // Step 1: Get the presigned download URL from the API
        fetch(`${self.apiUrl}/objects?key=${encodeURIComponent(params.Key)}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to get download URL: ${response.status} - ${response.statusText}`);
            }
            return response.json();
          })
          .then(data => {
            const downloadUrl = data.download_url;
            if (!downloadUrl) {
              throw new Error("Download URL missing in response");
            }

            // Step 2: Download from the presigned URL with progress tracking
            const xhr = new XMLHttpRequest();

            xhr.addEventListener("progress", (e) => {
              if (e.lengthComputable && progressCallback) {
                progressCallback({ loaded: e.loaded, total: e.total });
              }
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                callback(null, { Body: xhr.response });
              } else {
                callback(new Error(`Failed to download object: ${xhr.status} - ${xhr.statusText}`), null);
              }
            });

            xhr.addEventListener("error", () => callback(new Error("Network error during download"), null));

            xhr.open("GET", downloadUrl);
            xhr.responseType = "blob";
            xhr.send();
          })
          .catch(err => callback(err, null));
      }
    };

    // If callback is provided directly, call send immediately
    if (callback) {
      getObj.send(callback);
      return;
    }

    return getObj;
  }
}
