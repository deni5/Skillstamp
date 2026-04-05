import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChallengesService } from './challenges.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private s: ChallengesService) {}

  @Get()
  @ApiOperation({ summary: 'List challenges' })
  findAll(@Query('trackId') trackId?: string, @Query('difficulty') difficulty?: number) {
    return this.s.findAll({ trackId, difficulty });
  }

  @Get('my/completions')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'My completions' })
  myCompletions(@Request() req) { return this.s.getMyCompletions(req.user.walletAddress); }

  @Get(':id')
  @ApiOperation({ summary: 'Get challenge' })
  findOne(@Param('id') id: string) { return this.s.findOne(id); }

  @Post('start')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Start challenge' })
  start(@Request() req, @Body() body: { challengeId: string }) {
    return this.s.startChallenge(req.user, body.challengeId);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit work' })
  submit(@Request() req, @Param('id') id: string, @Body() body: { text: string; videoUrl?: string }) {
    return this.s.submitChallenge(req.user, id, body.text, body.videoUrl);
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  @ApiOperation({ summary: 'Manual verify' })
  verify(@Request() req, @Param('id') id: string, @Body() body: { score: number; feedback: string }) {
    return this.s.verifyManually(id, req.user.walletAddress, body.score, body.feedback);
  }
}
