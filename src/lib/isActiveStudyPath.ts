/** React Router accepts the trailing slash; layout must recognize it too. */
export function isActiveStudyPath(pathname: string): boolean {
  return /\/(?:study|mixed-study)\/?$/.test(pathname);
}
