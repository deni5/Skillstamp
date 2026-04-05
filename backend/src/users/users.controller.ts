import { Controller, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Request() req) { return this.usersService.findById(req.user.id); }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Reputation leaderboard' })
  getLeaderboard() { return this.usersService.getLeaderboard(); }

  @Get(':wallet')
  @ApiOperation({ summary: 'Public profile by wallet' })
  getByWallet(@Param('wallet') wallet: string) { return this.usersService.findByWallet(wallet); }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile' })
  updateProfile(@Request() req, @Body() dto: any) { return this.usersService.updateProfile(req.user.id, dto); }

  @Patch('me/onboarding')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete onboarding' })
  onboarding(@Request() req, @Body() dto: any) { return this.usersService.completeOnboarding(req.user.id, dto); }
}
