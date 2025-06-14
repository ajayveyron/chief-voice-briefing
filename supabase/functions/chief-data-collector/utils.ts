// Utility functions for the Chief Data Collector

// Function to create content hash for deduplication
export function createContentHash(content: any, sourceId: string): string {
  const contentString = JSON.stringify(content) + sourceId;
  return btoa(contentString).slice(0, 64); // Simple hash for demo
}