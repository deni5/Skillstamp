import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('message')
  @ApiOperation({ summary: 'Get message to sign' })
  getMessage(@Body() body: { walletAddress: string }) {
    return { message: this.authService.generateAuthMessage(body.walletAddress) };
  }

  @Post('wallet')
  @ApiOperation({ summary: 'Login with wallet' })
  walletLogin(@Body('walletAddress') walletAddress: string, @Body('email') email?: string) {
    const body = { walletAddress, email };
    return this.authService.loginWithWallet(walletAddress, email);
  }

  @Post('privy')
  @ApiOperation({ summary: 'Login with Privy token' })
  privyLogin(@Body() body: { privyToken: string }) {
    return this.authService.loginWithPrivy(body.privyToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  getMe(@Request() req) { return req.user; }
}
