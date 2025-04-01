import DiscountForm from "@/components/deepPass/DiscountForm";
import { getLoggedInUser } from "@/lib/actions/user.actions";

export default async function DeepPass() {
    const loggedIn = await getLoggedInUser();
    const userId = loggedIn?.id

    // const applePassess = getApplePasses(userId);
        return(
            <div className="flex flex-col items-center p-8">
                <h1 className="text-3xl font-bold mb-4">DeepPass</h1>
                <p className="text-lg mb-6">Create a digital pass for your business.</p>
                <DiscountForm userId={userId}/>
            </div>
        );
}