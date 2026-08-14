import { UserDocument } from './schemas/user.schema';

export function toAdminUserView(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: (user as unknown as { createdAt: Date }).createdAt,
  };
}
