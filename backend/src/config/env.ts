const JWT_SECRET = process.env.JWT_SECRET;

export const getJWTSecret = (): string => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return JWT_SECRET;
};
