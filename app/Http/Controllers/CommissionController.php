<?php
namespace App\Http\Controllers;
use App\Models\Commission;
use Illuminate\Http\Request;

class CommissionController extends Controller
{
    public function index(Request $request)
    {
        $query = Commission::with(['vente', 'user']);
        if ($request->statut) $query->where('statut', $request->statut);
        if ($request->user_id) $query->where('user_id', $request->user_id);
        return response()->json($query->latest()->paginate(10));
    }

    public function show(Commission $commission)
    {
        return response()->json($commission->load(['vente', 'user']));
    }

    public function update(Request $request, Commission $commission)
    {
        $commission->update($request->all());
        return response()->json($commission);
    }

    public function store(Request $request) {}
    public function destroy(Commission $commission) {}
}