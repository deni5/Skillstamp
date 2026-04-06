import { Controller, Post, Body, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnChainVerifierService } from './on-chain-verifier.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('challenges')
@Controller('challenges/on-chain')
export class OnChainController {
  constructor(private verifier: OnChainVerifierService) {}

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify on-chain challenge by Program ID' })
  async verify(
    @Request() req,
    @Body() body: { programId: string; challengeId: string },
  ) {
    const { programId, challengeId } = body;

    // Define rules per challenge type
    // In production: load rules from Challenge entity
    const rules = this.getRulesForChallenge(challengeId);

    const result = await this.verifier.verify(programId, rules, challengeId);

    return {
      programId,
      challengeId,
      student: req.user.walletAddress,
      ...result,
    };
  }

  @Get('info/:programId')
  @ApiOperation({ summary: 'Get program info from Devnet' })
  getProgramInfo(@Param('programId') programId: string) {
    return this.verifier.getProgramInfo(programId);
  }

  private getRulesForChallenge(challengeId: string) {
    // Hardcoded rules for prototype — move to DB in V2
    const rulesets: Record<string, any[]> = {
      'hello-solana': [
        { type: 'program_deployed' },
      ],
      'counter-program': [
        { type: 'program_deployed' },
        { type: 'account_data', expectedValue: 42, dataOffset: 8, dataLength: 8 },
      ],
      default: [
        { type: 'program_deployed' },
      ],
    };
    return rulesets[challengeId] || rulesets['default'];
  }
}
