import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

interface Match {
  id: number;
  team1: string;
  team2: string;
  score1?: number;
  score2?: number;
  winner?: string;
  scheduled?: string;
}

interface BracketRound {
  name: string;
  matches: Match[];
}

interface TournamentBracketProps {
  rounds: BracketRound[];
}

const TournamentBracket = ({ rounds }: TournamentBracketProps) => {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max">
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="flex flex-col justify-around min-w-[280px]">
            <div className="text-center mb-6">
              <Badge variant="secondary" className="text-sm font-semibold">
                {round.name}
              </Badge>
            </div>
            <div className="space-y-8">
              {round.matches.map((match) => (
                <Card
                  key={match.id}
                  className={`${
                    match.winner
                      ? "border-primary/50 bg-gradient-pitch"
                      : "border-border"
                  }`}
                >
                  <CardContent className="p-4">
                    {match.scheduled && !match.winner && (
                      <p className="text-xs text-muted-foreground mb-3 text-center">
                        {match.scheduled}
                      </p>
                    )}
                    <div className="space-y-2">
                      {/* Team 1 */}
                      <div
                        className={`flex items-center justify-between p-3 rounded ${
                          match.winner === match.team1
                            ? "bg-primary/20 border-l-4 border-primary"
                            : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {match.winner === match.team1 && (
                            <Trophy className="w-4 h-4 text-primary" />
                          )}
                          <span
                            className={`font-semibold ${
                              match.winner === match.team1
                                ? "text-primary"
                                : ""
                            }`}
                          >
                            {match.team1}
                          </span>
                        </div>
                        {match.score1 !== undefined && (
                          <span className="text-xl font-bold">{match.score1}</span>
                        )}
                      </div>

                      {/* Team 2 */}
                      <div
                        className={`flex items-center justify-between p-3 rounded ${
                          match.winner === match.team2
                            ? "bg-primary/20 border-l-4 border-primary"
                            : "bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {match.winner === match.team2 && (
                            <Trophy className="w-4 h-4 text-primary" />
                          )}
                          <span
                            className={`font-semibold ${
                              match.winner === match.team2
                                ? "text-primary"
                                : ""
                            }`}
                          >
                            {match.team2}
                          </span>
                        </div>
                        {match.score2 !== undefined && (
                          <span className="text-xl font-bold">{match.score2}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentBracket;
