import DiscountForm from "@/components/deepPass/DiscountForm";

export default async function DeepPass() {
    return (
        <div className="flex flex-col items-center p-8">
            <h1 className="text-3xl font-bold mb-4">DeepPass</h1>
            <p className="text-lg mb-6">Create a digital pass for your business.</p>
            <DiscountForm />
        </div>
    );
}