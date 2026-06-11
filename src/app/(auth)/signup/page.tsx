import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SignupPage() {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <GoogleButton />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">o con tu email</span>
          <Separator className="flex-1" />
        </div>

        <SignupForm />
      </CardContent>
    </Card>
  );
}
