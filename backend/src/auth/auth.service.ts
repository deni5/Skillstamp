import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  generateToken(user: User): string {
    return this.jwtService.sign({ sub: user.id, walletAddress: user.walletAddress, role: user.role });
  }

  async loginWithWallet(walletAddress: string, email?: string): Promise<{ user: User; token: string }> {
    const user = await this.usersService.findOrCreate(walletAddress, email);
    return { user, token: this.generateToken(user) };
  }

  async loginWithPrivy(privyToken: string): Promise<{ user: User; token: string }> {
    try {
      const decoded = JSON.parse(Buffer.from(privyToken.split('.')[1], 'base64').toString());
      const walletAddress = decoded.wallet?.address || decoded.linked_accounts?.find((a: any) => a.type === 'wallet')?.address;
      if (!walletAddress) throw new Error('No wallet');
      const email = decoded.email;
      return this.loginWithWallet(walletAddress, email);
    } catch {
      throw new UnauthorizedException('Invalid Privy token');
    }
  }

  generateAuthMessage(walletAddress: string): string {
    return `Sign in to Skillstamp\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
  }
}
