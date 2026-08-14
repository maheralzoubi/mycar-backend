export type Role = 'customer' | 'driver' | 'admin';

export interface JwtPayload {
  sub: string;
  role: Role;
  email: string;
}
