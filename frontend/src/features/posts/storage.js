/** Persist browser-local demo records, never credentials for a real service.
 * Notes:
 *   User passwords are plaintext. Do not use real passwords or sensitive data.
 *   Reads leave corrupt data untouched; writes are validated and never silently fail.
 */
const postFields = ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'];
const userFields = ['id', 'displayName', 'username', 'password', 'role', 'createdAt'];

/** Check complete models and unique identities without modifying records.
 * Args:
 *   records: Candidate collection from storage or a caller.
 *   fields: Required nonblank string fields for this collection.
 * Returns:
 *   Whether every record conforms to its model.
 */
function validRecords(records, fields) {
  if (!Array.isArray(records)) return false;
  const ids = new Set();
  return records.every((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    if (!fields.every((field) => typeof record[field] === 'string' && record[field].trim())) return false;
    if (!Number.isFinite(Date.parse(record.createdAt)) || ids.has(record.id)) return false;
    if (fields === userFields && !['admin', 'user'].includes(record.role)) return false;
    ids.add(record.id);
    return true;
  });
}

/** Read a collection best-effort without erasing malformed local data.
 * Args:
 *   key: Browser storage key for this collection.
 *   fields: Required model fields.
 * Returns:
 *   Valid records, or an empty array on any read/model failure.
 */
function readRecords(key, fields) {
  try {
    const records = JSON.parse(localStorage.getItem(key));
    return validRecords(records, fields) ? records : [];
  } catch {
    return [];
  }
}

/** Save a complete validated collection or throw an actionable failure.
 * Args:
 *   key: Browser storage key for this collection.
 *   fields: Required model fields.
 *   records: Complete replacement collection; no mutation is performed.
 * Raises:
 *   Error: Invalid model, serialization failure, unavailable storage or quota failure.
 */
function writeRecords(key, fields, records) {
  if (!validRecords(records, fields)) {
    throw new Error(`Cannot save ${key}: provide an array of complete records with valid dates, roles and unique IDs.`);
  }
  try {
    const serialized = JSON.stringify(records);
    if (!validRecords(JSON.parse(serialized), fields)) throw new Error('Invalid serialized model');
    localStorage.setItem(key, serialized);
  } catch (cause) {
    throw new Error(`Could not save ${key}. Enable browser storage and free local space, then retry. Your changes were not saved.`, { cause });
  }
}

/** Read local posts gracefully.
 * Returns:
 *   Valid post records, or an empty array when storage cannot be read.
 */
export function getPosts() {
  return readRecords('writespace_posts', postFields);
}

/** Replace local posts after model validation.
 * Args:
 *   records: Complete post collection to persist.
 * Raises:
 *   Error: Invalid records or unsuccessful browser persistence.
 */
export function savePosts(records) {
  writeRecords('writespace_posts', postFields, records);
}

/** Read local demo accounts gracefully.
 * Returns:
 *   Valid account records, or an empty array on read failure.
 */
export function getUsers() {
  return readRecords('writespace_users', userFields);
}

/** Replace local demo accounts after model validation.
 * Args:
 *   records: Complete account collection; passwords remain plaintext.
 * Raises:
 *   Error: Invalid records or unsuccessful browser persistence.
 */
export function saveUsers(records) {
  writeRecords('writespace_users', userFields, records);
}
